"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { navigation, isNavItemActive } from "@/lib/navigation"
import { ChecklistMiniView } from "@/components/guidance"
import { VisibleNavItem } from "@/lib/visibility"
import type { ElementId } from "@/lib/visibility/elements"
import type { ModuleKey } from "@/lib/modules/definitions"

// Map navigation paths to visibility element IDs
function getNavElementId(href: string): ElementId | null {
  const pathToElementId: Record<string, ElementId> = {
    "/dashboard": "nav:dashboard",
    "/invoices": "nav:invoices",
    "/e-invoices": "nav:e-invoices",
    "/contacts": "nav:contacts",
    "/customers": "nav:customers",
    "/products": "nav:products",
    "/expenses": "nav:expenses",
    "/documents": "nav:documents",
    "/import": "nav:import",
    "/vat": "nav:vat",
    "/pausalni": "nav:pausalni",
    "/reports": "nav:reports",
    "/doprinosi": "nav:doprinosi",
    "/corporate-tax": "nav:corporate-tax",
    "/banking": "nav:bank",
    "/pos": "nav:pos",
    "/compliance": "nav:compliance",
    "/settings": "nav:settings",
  }
  return pathToElementId[href] || null
}

interface SidebarProps {
  defaultCollapsed?: boolean
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
  company?: {
    name: string
    eInvoiceProvider?: string | null
    isVatPayer: boolean
    legalForm?: string | null
    entitlements?: string[] // Raw string array from DB
  }
}

export function Sidebar({ defaultCollapsed = false, user, company }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)
  const pathname = usePathname()

  // Cast raw DB entitlements to known module keys
  const entitlements = (company?.entitlements || []) as ModuleKey[]

  return (
    <aside
      className={cn(
        "sticky top-16 h-[calc(100vh-4rem)] border-r border-[var(--border)]/50 bg-[var(--surface)]/50 backdrop-blur-xl transition-all duration-300",
        isCollapsed ? "w-[var(--sidebar-collapsed-width)]" : "w-[var(--sidebar-width)]"
      )}
    >
      <div className="flex h-full flex-col">
        {!isCollapsed && (
          <div className="border-b border-[var(--border)]/50 p-3">
            <div className="rounded-2xl bg-white/40 dark:bg-white/5 backdrop-blur-md shadow-sm border border-white/20 px-3 py-3">
              <div className="flex items-center gap-3">
                {user.image ? (
                  <Image
                    src={user.image}
                    alt={user.name || "Profile"}
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-semibold">
                    {(user.name || user.email || "U").slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--foreground)] truncate">
                    {user.name || user.email}
                  </p>
                  {company && (
                    <p className="text-xs text-[var(--muted)] truncate">{company.name}</p>
                  )}
                </div>
              </div>
              {company && (
                <div className="mt-3 flex gap-2 text-xs text-[var(--muted)]">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 font-medium",
                      company.eInvoiceProvider
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    )}
                  >
                    {company.eInvoiceProvider ? "Posrednik spojen" : "Posrednik nije konfiguriran"}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 font-medium",
                      company.isVatPayer ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"
                    )}
                  >
                    {company.isVatPayer ? "PDV obveznik" : "Nije PDV obveznik"}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Checklist mini-view */}
        <ChecklistMiniView collapsed={isCollapsed} className="mt-4" />

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin p-3">
          {navigation.map((section, sectionIdx) => (
            <div key={section.title} className={cn(sectionIdx > 0 && "mt-6")}>
              {/* Section Title */}
              {!isCollapsed && (
                <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  {section.title}
                </h3>
              )}

              {/* Section Items */}
              <div className="space-y-1">
                {section.items
                  .filter((item) => {
                    // 1. Check Module Entitlement (Database Truth)
                    if (item.module && company && !entitlements.includes(item.module)) {
                      return false
                    }

                    // 2. Check Legal Form (Legacy/Visibility)
                    if (item.showFor && company?.legalForm) {
                      if (!item.showFor.includes(company.legalForm)) return false
                    }

                    return true
                  })
                  .map((item) => {
                    const isActive = isNavItemActive(item, pathname)
                    const Icon = item.icon
                    const elementId = getNavElementId(item.href)

                    // Use VisibleNavItem if we have an element ID, otherwise fallback to Link
                    if (elementId) {
                      return (
                        <div key={item.href} className="relative">
                          <VisibleNavItem
                            id={elementId}
                            href={item.href}
                            icon={
                              <Icon
                                className={cn(
                                  "h-5 w-5 flex-shrink-0",
                                  isActive ? "text-brand-600" : "text-[var(--muted)]"
                                )}
                              />
                            }
                            label={item.name}
                            isActive={isActive}
                            className={cn(
                              "text-sm font-medium",
                              isActive
                                ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-400"
                                : "",
                              isCollapsed && "justify-center px-2"
                            )}
                          />
                          {!isCollapsed && item.badge !== undefined && item.badge > 0 && (
                            <span className="absolute right-3 top-2.5 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                              {item.badge}
                            </span>
                          )}
                          {isCollapsed && item.badge !== undefined && item.badge > 0 && (
                            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-brand-500" />
                          )}
                        </div>
                      )
                    }

                    // Fallback for items without element IDs
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={isCollapsed ? item.name : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-400"
                            : "text-[var(--foreground)] hover:bg-[var(--surface-secondary)]",
                          isCollapsed && "justify-center px-2"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-5 w-5 flex-shrink-0",
                            isActive ? "text-brand-600" : "text-[var(--muted)]"
                          )}
                        />

                        {!isCollapsed && (
                          <>
                            <span className="flex-1">{item.name}</span>
                            {item.badge !== undefined && item.badge > 0 && (
                              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                                {item.badge}
                              </span>
                            )}
                          </>
                        )}

                        {isCollapsed && item.badge !== undefined && item.badge > 0 && (
                          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-brand-500" />
                        )}
                      </Link>
                    )
                  })}
              </div>
            </div>
          ))}
        </nav>

        {/* Collapse Toggle */}
        <div className="border-t border-[var(--border)] p-3">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--muted)] hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)] transition-colors"
            aria-label={isCollapsed ? "Proširi izbornik" : "Skupi izbornik"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span>Skupi</span>
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  )
}
