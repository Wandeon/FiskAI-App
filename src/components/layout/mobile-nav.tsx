"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { navigation, isNavItemActive } from "@/lib/navigation"
import { CommandPalette } from "@/components/ui/command-palette"
import { VisibleNavItem } from "@/lib/visibility"
import type { ElementId } from "@/lib/visibility/elements"

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
    "/settings": "nav:settings",
    "/checklist": "nav:checklist",
  }
  return pathToElementId[href] || null
}

interface MobileNavProps {
  companyName?: string
  userName?: string
}

export function MobileNav({ companyName, userName }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  // Close on route change
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  return (
    <>
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed left-4 top-4 z-40 md:hidden rounded-lg bg-[var(--surface)] p-2 shadow-card border border-[var(--border)] hover:bg-[var(--surface-secondary)] transition-colors"
        aria-label="Otvori izbornik"
      >
        <Menu className="h-5 w-5 text-[var(--foreground)]" />
      </button>

      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 md:hidden",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      {/* Slide-out Drawer */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-72 bg-[var(--surface)] shadow-elevated transition-transform duration-300 md:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white font-bold text-lg">
              F
            </div>
            <div>
              <h2 className="font-semibold text-[var(--foreground)]">FiskAI</h2>
              {companyName && (
                <p className="text-xs text-[var(--muted)] truncate max-w-[140px]">{companyName}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-2 hover:bg-[var(--surface-secondary)] transition-colors"
            aria-label="Zatvori izbornik"
          >
            <X className="h-5 w-5 text-[var(--muted)]" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin p-4">
          {navigation.map((section, sectionIdx) => (
            <div key={section.title} className={cn(sectionIdx > 0 && "mt-6")}>
              <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                {section.title}
              </h3>

              <div className="space-y-1">
                {section.items.map((item) => {
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
                                "h-5 w-5",
                                isActive
                                  ? "text-brand-600 dark:text-brand-400"
                                  : "text-[var(--muted)]"
                              )}
                            />
                          }
                          label={item.name}
                          isActive={isActive}
                          className={cn(
                            "text-sm font-medium py-2.5",
                            isActive
                              ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-400"
                              : ""
                          )}
                        />
                        {item.badge !== undefined && item.badge > 0 && (
                          <span className="absolute right-3 top-3 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )
                  }

                  // Fallback for items without element IDs
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-400"
                          : "text-[var(--foreground)] hover:bg-[var(--surface-secondary)]"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-5 w-5",
                          isActive ? "text-brand-600 dark:text-brand-400" : "text-[var(--muted)]"
                        )}
                      />
                      <span className="flex-1">{item.name}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        {userName && (
          <div className="border-t border-[var(--border)] p-4">
            <p className="text-sm text-[var(--muted)]">Prijavljeni kao</p>
            <p className="font-medium text-[var(--foreground)] truncate">{userName}</p>
          </div>
        )}
      </aside>

      {/* Mobile command palette trigger */}
      <div className="fixed right-4 bottom-32 z-40 md:hidden">
        <CommandPalette triggerType="fab" />
      </div>
    </>
  )
}
