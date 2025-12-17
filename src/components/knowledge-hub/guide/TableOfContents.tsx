"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"

interface TOCItem {
  id: string
  title: string
  level: number // 2 = h2, 3 = h3
}

interface TableOfContentsProps {
  items: TOCItem[]
}

export function TableOfContents({ items }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>("")
  const router = useRouter()
  const searchParams = useSearchParams()
  const reduce = useReducedMotion()

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        })
      },
      { rootMargin: "-100px 0px -80% 0px" }
    )

    items.forEach((item) => {
      const element = document.getElementById(item.id)
      if (element) observer.observe(element)
    })

    return () => observer.disconnect()
  }, [items])

  const handleClick = (id: string) => {
    const element = document.getElementById(id)
    if (!element) return

    const panel = element.closest<HTMLElement>("[data-variant-tab-panel]")
    const desiredVariant = panel?.getAttribute("data-variant-tab-panel") ?? null
    const panelHidden = panel?.getAttribute("aria-hidden") === "true"

    if (desiredVariant && panelHidden && searchParams.get("varijanta") !== desiredVariant) {
      const params = new URLSearchParams(searchParams.toString())
      params.set("varijanta", desiredVariant)
      router.replace(`?${params.toString()}`, { scroll: false })

      const startedAt = performance.now()
      const maxWaitMs = 900
      const tryScroll = () => {
        const target = document.getElementById(id)
        const targetPanel = target?.closest<HTMLElement>("[data-variant-tab-panel]")
        const isHidden = targetPanel?.getAttribute("aria-hidden") === "true"

        if (target && !isHidden) {
          target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" })
          return
        }
        if (performance.now() - startedAt > maxWaitMs) return
        requestAnimationFrame(tryScroll)
      }
      requestAnimationFrame(tryScroll)
      return
    }

    element.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" })
  }

  return (
    <nav className="scrollbar-thin hidden lg:block sticky top-24 max-h-[calc(100vh-120px)] overflow-y-auto rounded-2xl surface-glass p-4">
      <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">Sadržaj</h2>
      <ul className="space-y-2 text-sm">
        {items.map((item) => (
          <li key={item.id}>
            <button
              onClick={() => handleClick(item.id)}
              className={cn(
                "w-full text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                item.level === 3 && "pl-3",
                activeId === item.id
                  ? "font-semibold text-[var(--accent)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              )}
            >
              {item.title}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
