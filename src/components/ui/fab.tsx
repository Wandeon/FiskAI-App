"use client"

import Link from "next/link"
import { Plus, X, FileText, Users, Package, Receipt } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface FABAction {
  href: string
  icon: React.ReactNode
  label: string
}

const defaultActions: FABAction[] = [
  { href: "/e-invoices/new", icon: <Receipt className="h-5 w-5" />, label: "E-račun" },
  { href: "/invoices/new", icon: <FileText className="h-5 w-5" />, label: "Račun" },
  { href: "/contacts/new", icon: <Users className="h-5 w-5" />, label: "Kontakt" },
  { href: "/products/new", icon: <Package className="h-5 w-5" />, label: "Proizvod" },
]

interface FABProps {
  actions?: FABAction[]
  className?: string
}

export function FAB({ actions = defaultActions, className }: FABProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className={cn("fixed right-4 bottom-20 z-fixed md:hidden", className)}>
      {/* Action buttons */}
      <div
        className={cn(
          "flex flex-col-reverse gap-3 mb-3 transition-all duration-200",
          isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        )}
      >
        {actions.map((action, index) => (
          <Link
            key={action.href}
            href={action.href}
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 animate-scale-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 rounded-lg"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <span className="rounded-lg bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--foreground)] shadow-elevated">
              {action.label}
            </span>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface)] text-brand-600 shadow-elevated">
              {action.icon}
            </div>
          </Link>
        ))}
      </div>

      {/* Main FAB button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full shadow-elevated transition-all duration-200 touch-target",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2",
          isOpen
            ? "bg-[var(--surface-secondary)] text-[var(--foreground)] rotate-45"
            : "bg-brand-600 text-white"
        )}
        aria-label={isOpen ? "Zatvori izbornik" : "Otvori brze akcije"}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </button>
    </div>
  )
}
