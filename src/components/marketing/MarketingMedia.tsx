"use client"

import { useEffect, useRef } from "react"
import { useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"

export function MarketingVideo({
  src,
  poster,
  label,
  className,
}: {
  src: string
  poster?: string
  label?: string
  className?: string
}) {
  const reduce = useReducedMotion()
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let isInView = true
    let isPageVisible = document.visibilityState === "visible"

    const syncPlayback = () => {
      if (reduce || !isInView || !isPageVisible) {
        video.pause()
        return
      }

      const promise = video.play()
      // video.play() returns Promise<void> in modern browsers
      void promise.catch(() => {})
    }

    const handleVisibilityChange = () => {
      isPageVisible = document.visibilityState === "visible"
      syncPlayback()
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entries) => {
              const entry = entries[0]
              isInView = Boolean(entry?.isIntersecting)
              syncPlayback()
            },
            { threshold: 0.15 }
          )
        : null

    observer?.observe(video)
    syncPlayback()

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      observer?.disconnect()
    }
  }, [reduce, src])

  return (
    <video
      ref={videoRef}
      className={cn("h-full w-full rounded-lg object-cover", className)}
      src={src}
      poster={poster}
      muted
      playsInline
      loop
      preload="metadata"
      autoPlay={!reduce}
      controls={reduce ?? false}
      aria-label={label}
    />
  )
}
