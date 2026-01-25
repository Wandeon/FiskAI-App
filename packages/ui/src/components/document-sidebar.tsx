"use client"

import Link from "next/link"

import { cn } from "../lib/utils"

export interface DocumentSidebarProps {
  categories: { value: string; label: string }[]
  activeCategory: string | undefined
  counts: Record<string, number>
  className?: string
}

export function DocumentSidebar({
  categories,
  activeCategory,
  counts,
  className,
}: DocumentSidebarProps) {
  return (
    <nav aria-label="Kategorije dokumenata" className={cn("", className)}>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-500">
        Kategorije
      </h2>
      <ul className="space-y-1">
        <li>
          <Link
            href="/dokumenti"
            className={cn(
              "flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
              !activeCategory
                ? "bg-primary-100 font-medium text-primary-900"
                : "text-neutral-700 hover:bg-neutral-100"
            )}
            aria-current={!activeCategory ? "page" : undefined}
          >
            <span>Sve kategorije</span>
            <span className="text-xs text-neutral-500">
              {Object.values(counts).reduce((a, b) => a + b, 0)}
            </span>
          </Link>
        </li>
        {categories.map((cat) => (
          <li key={cat.value}>
            <Link
              href={`/dokumenti?kategorija=${cat.value}`}
              className={cn(
                "flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
                activeCategory === cat.value
                  ? "bg-primary-100 font-medium text-primary-900"
                  : "text-neutral-700 hover:bg-neutral-100"
              )}
              aria-current={activeCategory === cat.value ? "page" : undefined}
            >
              <span>{cat.label}</span>
              <span className="text-xs text-neutral-500">{counts[cat.value] || 0}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
