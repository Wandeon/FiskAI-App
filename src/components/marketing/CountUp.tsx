"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { useAnimatedNumber } from "@/hooks/use-animated-number"

type Format = (value: number) => string

export function CountUp({
  value,
  className,
  durationMs = 900,
  startOnView = true,
  format,
}: {
  value: number
  className?: string
  durationMs?: number
  startOnView?: boolean
  format?: Format
}) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const [active, setActive] = useState(!startOnView)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(true)

  useEffect(() => {
    const mediaQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)")
    setPrefersReducedMotion(mediaQuery?.matches ?? false)

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mediaQuery?.addEventListener?.("change", handler)
    return () => mediaQuery?.removeEventListener?.("change", handler)
  }, [])

  useEffect(() => {
    if (!startOnView) return
    if (prefersReducedMotion) {
      setActive(true)
      return
    }

    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setActive(true)
          observer.disconnect()
        }
      },
      { threshold: 0.35, rootMargin: "0px 0px -20% 0px" }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [prefersReducedMotion, startOnView])

  const animated = useAnimatedNumber(active ? value : 0, { durationMs })

  const display = format ? format(animated) : Math.round(animated).toString()

  return (
    <span ref={ref} className={cn(className)}>
      {display}
    </span>
  )
}
