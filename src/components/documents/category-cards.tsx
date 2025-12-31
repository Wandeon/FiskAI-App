"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import type { DocumentCategory } from "@/lib/documents/unified-query"

interface CategoryCardsProps {
  counts: {
    all: number
    invoice: number
    eInvoice: number
    bankStatement: number
    expense: number
  }
  activeCategory?: DocumentCategory
  compact?: boolean
}

const CATEGORIES: Array<{
  key: DocumentCategory | "all"
  label: string
  param: string
}> = [
  { key: "all", label: "Svi", param: "" },
  { key: "invoice", label: "Računi", param: "invoice" },
  { key: "e-invoice", label: "E-Računi", param: "e-invoice" },
  { key: "bank-statement", label: "Izvodi", param: "bank-statement" },
  { key: "expense", label: "Troškovi", param: "expense" },
]

export function CategoryCards({ counts, activeCategory, compact = true }: CategoryCardsProps) {
  const getCount = (key: DocumentCategory | "all") => {
    switch (key) {
      case "all":
        return counts.all
      case "invoice":
        return counts.invoice
      case "e-invoice":
        return counts.eInvoice
      case "bank-statement":
        return counts.bankStatement
      case "expense":
        return counts.expense
      default:
        return 0
    }
  }

  const isActive = (key: DocumentCategory | "all") => {
    if (key === "all") return !activeCategory
    return activeCategory === key
  }

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(({ key, label, param }) => {
          const count = getCount(key)
          const active = isActive(key)
          const href = param ? `/documents?category=${param}` : "/documents"

          return (
            <Link
              key={key}
              href={href}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
                active
                  ? "bg-interactive text-white shadow-md"
                  : "bg-surface-2 text-foreground hover:bg-surface-2"
              )}
            >
              <span>{label}</span>
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-bold",
                  active ? "bg-surface/20 text-white" : "bg-surface text-secondary"
                )}
              >
                {count}
              </span>
            </Link>
          )
        })}
      </div>
    )
  }

  // Full card layout (legacy, for backwards compatibility)
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
      {CATEGORIES.map(({ key, label, param }) => {
        const count = getCount(key)
        const active = isActive(key)
        const href = param ? `/documents?category=${param}` : "/documents"

        return (
          <Link key={key} href={href}>
            <div
              className={cn(
                "cursor-pointer transition-all hover:shadow-md rounded-xl border p-4 text-center",
                active && "ring-2 ring-border-focus bg-info-bg"
              )}
            >
              <p className={cn("text-2xl font-bold", active ? "text-link" : "text-foreground")}>
                {count}
              </p>
              <p className={cn("text-sm", active ? "text-link" : "text-tertiary")}>{label}</p>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
