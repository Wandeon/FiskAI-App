"use client"

import { useEffect, useRef } from "react"
import { useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"

type Point = {
  x: number
  y: number
  vx: number
  vy: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function PlexusBackground({
  className,
  density = 0.00011,
  maxPoints = 90,
}: {
  className?: string
  density?: number
  maxPoints?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext("2d")
    if (!context) return

    if (reduceMotion) {
      return
    }

    let animationFrame: number | null = null
    let points: Point[] = []
    let width = 0
    let height = 0
    let dpr = 1
    let isInView = true
    let isPageVisible =
      typeof document !== "undefined" ? document.visibilityState === "visible" : true
    let isRunning = false
    let cachedRect: DOMRect | null = null

    const mouse = { x: -9999, y: -9999 }

    const stop = () => {
      isRunning = false
      if (animationFrame) cancelAnimationFrame(animationFrame)
      animationFrame = null
    }

    const start = () => {
      if (isRunning) return
      isRunning = true
      animationFrame = requestAnimationFrame(tick)
    }

    const syncRunningState = () => {
      const shouldRun = isInView && isPageVisible
      if (shouldRun) start()
      else stop()
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      width = Math.max(1, Math.floor(rect.width))
      height = Math.max(1, Math.floor(rect.height))
      dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1
      cachedRect = rect

      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`

      context.setTransform(dpr, 0, 0, dpr, 0, 0)

      const targetCount = clamp(Math.round(width * height * density), 22, maxPoints)
      if (points.length === targetCount) return

      points = Array.from({ length: targetCount }, () => {
        const speed = 0.22 + Math.random() * 0.35
        const angle = Math.random() * Math.PI * 2
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
        }
      })
    }

    const handlePointerMove = (event: PointerEvent) => {
      const rect = cachedRect ?? canvas.getBoundingClientRect()
      cachedRect = rect
      mouse.x = event.clientX - rect.left
      mouse.y = event.clientY - rect.top
    }

    const handlePointerLeave = () => {
      mouse.x = -9999
      mouse.y = -9999
    }

    const tick = () => {
      if (!isRunning) return
      context.clearRect(0, 0, width, height)

      const linkDistance = Math.min(170, Math.max(110, width * 0.18))
      const mouseInfluence = 160

      for (const p of points) {
        p.x += p.vx
        p.y += p.vy

        if (p.x <= 0 || p.x >= width) p.vx *= -1
        if (p.y <= 0 || p.y >= height) p.vy *= -1

        p.x = clamp(p.x, 0, width)
        p.y = clamp(p.y, 0, height)

        const dxm = p.x - mouse.x
        const dym = p.y - mouse.y
        const dm = Math.hypot(dxm, dym)
        if (dm < mouseInfluence) {
          const pull = (1 - dm / mouseInfluence) * 0.08
          p.vx += (-dxm / Math.max(dm, 0.001)) * pull
          p.vy += (-dym / Math.max(dm, 0.001)) * pull
          p.vx = clamp(p.vx, -0.9, 0.9)
          p.vy = clamp(p.vy, -0.9, 0.9)
        }
      }

      context.lineWidth = 1
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const a = points[i]
          const b = points[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const d = Math.hypot(dx, dy)
          if (d > linkDistance) continue

          const opacity = (1 - d / linkDistance) * 0.28
          context.strokeStyle = `rgba(255,255,255,${opacity})`
          context.beginPath()
          context.moveTo(a.x, a.y)
          context.lineTo(b.x, b.y)
          context.stroke()
        }
      }

      for (const p of points) {
        const dxm = p.x - mouse.x
        const dym = p.y - mouse.y
        const dm = Math.hypot(dxm, dym)
        const alpha = dm < mouseInfluence ? 0.9 : 0.55

        context.fillStyle = `rgba(255,255,255,${alpha})`
        context.beginPath()
        context.arc(p.x, p.y, 1.4, 0, Math.PI * 2)
        context.fill()
      }

      if (isRunning) animationFrame = requestAnimationFrame(tick)
    }

    resize()
    syncRunningState()

    const handleScroll = () => {
      cachedRect = canvas.getBoundingClientRect()
    }

    const handleVisibilityChange = () => {
      isPageVisible = document.visibilityState === "visible"
      syncRunningState()
    }

    window.addEventListener("resize", resize)
    window.addEventListener("scroll", handleScroll, { passive: true })
    window.addEventListener("pointermove", handlePointerMove, { passive: true })
    window.addEventListener("pointerleave", handlePointerLeave, { passive: true })
    document.addEventListener("visibilitychange", handleVisibilityChange)

    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entries) => {
              const entry = entries[0]
              isInView = Boolean(entry?.isIntersecting)
              syncRunningState()
            },
            { threshold: 0.05 }
          )
        : null

    observer?.observe(canvas)

    return () => {
      window.removeEventListener("resize", resize)
      window.removeEventListener("scroll", handleScroll)
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerleave", handlePointerLeave)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      observer?.disconnect()
      stop()
    }
  }, [density, maxPoints, reduceMotion])

  return (
    <canvas
      ref={canvasRef}
      className={cn("pointer-events-none absolute inset-0 h-full w-full opacity-70", className)}
      aria-hidden="true"
    />
  )
}
